use soroban_sdk::{Address, Env};
use soroban_sdk::token::TokenClient;

use crate::common::error::Error;
use crate::common::events::Events;
use crate::common::storage::Storage;
use crate::common::types::BASIS_POINTS;
use crate::operations::liquidation::Liquidations;

/// Safety buffer above maintenance margin (0.5% = 50 basis points)
/// Used in get_available_margin to prevent accidental liquidation
const MARGIN_SAFETY_BUFFER_BP: i128 = 50;

/// Margin management functions for RWA Perpetuals
pub struct Margins;

impl Margins {
    /// Add collateral to an existing position
    ///
    /// Allows traders to deposit additional margin to their position, improving the margin ratio
    /// and reducing liquidation risk. The margin token must be configured by the admin first.
    ///
    /// # Arguments
    /// * `env` - The contract environment
    /// * `trader` - Address of the position owner (must authorize transaction)
    /// * `rwa_token` - Address of the RWA token for the position
    /// * `amount` - Amount of margin tokens to add (must be > 0)
    ///
    /// # Returns
    /// * `Ok(())` - Margin successfully added
    /// * `Err(Error)` - Various errors (see error codes below)
    ///
    /// # Errors
    /// * `InvalidInput` - Amount is <= 0
    /// * `ProtocolPaused` - Protocol operations are paused
    /// * `PositionNotFound` - Position doesn't exist
    /// * `MarketNotFound` - Market configuration not found
    /// * `MarketInactive` - Market is not active
    /// * `MarginTokenNotSet` - Margin token not configured
    /// * `ArithmeticError` - Overflow in calculations
    pub fn add_margin(
        env: &Env,
        trader: &Address,
        rwa_token: &Address,
        amount: i128,
    ) -> Result<(), Error> {
        // 1. Authorization
        trader.require_auth();

        // 2. Validation
        if amount <= 0 {
            return Err(Error::InvalidInput);
        }

        let storage = Storage::get(env);
        if storage.protocol_paused {
            return Err(Error::ProtocolPaused);
        }

        // 3. Get position
        let mut position = Storage::get_position(env, trader, rwa_token)
            .ok_or(Error::PositionNotFound)?;

        // 4. Validate market
        let market = Storage::get_market_config(env, rwa_token)
            .ok_or(Error::MarketNotFound)?;
        if !market.is_active {
            return Err(Error::MarketInactive);
        }

        // 5. Transfer tokens from trader to contract
        let margin_token = Storage::get_margin_token(env)
            .ok_or(Error::MarginTokenNotSet)?;
        let token_client = TokenClient::new(env, &margin_token);
        let contract_address = env.current_contract_address();
        token_client.transfer(trader, &contract_address, &amount);

        // 6. Update position margin
        position.margin = position.margin
            .checked_add(amount)
            .ok_or(Error::ArithmeticError)?;
        Storage::set_position(env, trader, rwa_token, &position);

        // 7. Emit event
        Events::margin_added(env, trader, rwa_token, amount, position.margin);

        Ok(())
    }

    /// Remove collateral from an existing position
    ///
    /// Allows traders to withdraw excess margin from their position. The withdrawal is only
    /// permitted if the post-withdrawal margin ratio remains above the maintenance margin
    /// requirement, preventing the position from becoming liquidatable.
    ///
    /// # Arguments
    /// * `env` - The contract environment
    /// * `trader` - Address of the position owner (must authorize transaction)
    /// * `rwa_token` - Address of the RWA token for the position
    /// * `amount` - Amount of margin tokens to remove (must be > 0 and <= position.margin)
    ///
    /// # Returns
    /// * `Ok(())` - Margin successfully removed
    /// * `Err(Error)` - Various errors (see error codes below)
    ///
    /// # Errors
    /// * `InvalidInput` - Amount is <= 0
    /// * `ProtocolPaused` - Protocol operations are paused
    /// * `PositionNotFound` - Position doesn't exist
    /// * `InsufficientMargin` - Amount exceeds available margin
    /// * `MarketNotFound` - Market configuration not found
    /// * `MarketInactive` - Market is not active
    /// * `OraclePriceNotFound` - Cannot fetch current price
    /// * `MarginRatioBelowMaintenance` - Removal would violate margin requirements
    /// * `MarginTokenNotSet` - Margin token not configured
    /// * `ArithmeticError` - Overflow in calculations
    /// * `DivisionByZero` - Position value is zero
    pub fn remove_margin(
        env: &Env,
        trader: &Address,
        rwa_token: &Address,
        amount: i128,
    ) -> Result<(), Error> {
        // 1. Authorization
        trader.require_auth();

        // 2. Validation
        if amount <= 0 {
            return Err(Error::InvalidInput);
        }

        let storage = Storage::get(env);
        if storage.protocol_paused {
            return Err(Error::ProtocolPaused);
        }

        // 3. Get position
        let mut position = Storage::get_position(env, trader, rwa_token)
            .ok_or(Error::PositionNotFound)?;

        if amount > position.margin {
            return Err(Error::InsufficientMargin);
        }

        // 4. Validate market
        let market = Storage::get_market_config(env, rwa_token)
            .ok_or(Error::MarketNotFound)?;
        if !market.is_active {
            return Err(Error::MarketInactive);
        }

        // 5. Get current price
        let current_price = Storage::get_current_price(env, rwa_token)
            .ok_or(Error::OraclePriceNotFound)?;

        // 6. Calculate post-removal margin ratio
        let new_margin = position.margin
            .checked_sub(amount)
            .ok_or(Error::ArithmeticError)?;

        let unrealized_pnl = Liquidations::calculate_unrealized_pnl(&position, current_price)?;
        let position_value = Liquidations::calculate_position_value(&position, current_price)?;

        let effective_margin = new_margin
            .checked_add(unrealized_pnl)
            .ok_or(Error::ArithmeticError)?;

        if position_value == 0 {
            return Err(Error::DivisionByZero);
        }

        let margin_ratio = effective_margin
            .checked_mul(BASIS_POINTS)
            .ok_or(Error::ArithmeticError)?
            .checked_div(position_value)
            .ok_or(Error::DivisionByZero)?;

        // 7. Validate margin ratio stays above maintenance margin
        if margin_ratio < (market.maintenance_margin as i128) {
            return Err(Error::MarginRatioBelowMaintenance);
        }

        // 8. Transfer tokens from contract back to trader
        let margin_token = Storage::get_margin_token(env)
            .ok_or(Error::MarginTokenNotSet)?;
        let token_client = TokenClient::new(env, &margin_token);
        let contract_address = env.current_contract_address();
        token_client.transfer(&contract_address, trader, &amount);

        // 9. Update position margin
        position.margin = new_margin;
        Storage::set_position(env, trader, rwa_token, &position);

        // 10. Emit event
        Events::margin_removed(env, trader, rwa_token, amount, new_margin, margin_ratio);

        Ok(())
    }

    /// Calculate the current margin ratio for a position
    ///
    /// Returns the margin ratio in basis points, which indicates the health of a position.
    /// The margin ratio is calculated as:
    ///
    /// margin_ratio = (margin + unrealized_pnl) / position_value * BASIS_POINTS
    ///
    /// A higher ratio indicates a healthier position. If the ratio falls below the
    /// maintenance margin threshold, the position becomes liquidatable.
    ///
    /// # Arguments
    /// * `env` - The contract environment
    /// * `trader` - Address of the position owner
    /// * `rwa_token` - Address of the RWA token for the position
    ///
    /// # Returns
    /// * `Ok(margin_ratio)` - Margin ratio in basis points (e.g., 1500 = 15%)
    /// * `Err(Error)` - Various errors (see error codes below)
    ///
    /// # Errors
    /// * `PositionNotFound` - Position doesn't exist
    /// * `OraclePriceNotFound` - Cannot fetch current price
    /// * `ArithmeticError` - Overflow in calculations
    /// * `DivisionByZero` - Position value is zero
    ///
    /// # Example
    /// ```ignore
    /// // If margin_ratio = 1500, the position has 15% margin
    /// // If maintenance_margin = 500 (5%), the position is healthy
    /// ```
    pub fn calculate_margin_ratio(
        env: &Env,
        trader: &Address,
        rwa_token: &Address,
    ) -> Result<i128, Error> {
        let position = Storage::get_position(env, trader, rwa_token)
            .ok_or(Error::PositionNotFound)?;

        let current_price = Storage::get_current_price(env, rwa_token)
            .ok_or(Error::OraclePriceNotFound)?;

        let unrealized_pnl = Liquidations::calculate_unrealized_pnl(&position, current_price)?;
        let position_value = Liquidations::calculate_position_value(&position, current_price)?;

        let effective_margin = position.margin
            .checked_add(unrealized_pnl)
            .ok_or(Error::ArithmeticError)?;

        if position_value == 0 {
            return Err(Error::DivisionByZero);
        }

        let margin_ratio = effective_margin
            .checked_mul(BASIS_POINTS)
            .ok_or(Error::ArithmeticError)?
            .checked_div(position_value)
            .ok_or(Error::DivisionByZero)?;

        Ok(margin_ratio)
    }

    /// Get the amount of margin that can be safely removed from a position
    ///
    /// Calculates how much margin can be withdrawn while maintaining a safe distance above
    /// the maintenance margin threshold. This function includes a safety buffer to prevent
    /// accidental liquidation.
    ///
    /// The calculation:
    /// 1. Determines the minimum required margin (maintenance_margin + safety_buffer)
    /// 2. Subtracts this from the effective margin (margin + unrealized_pnl)
    /// 3. Caps the result at the actual deposited margin amount
    ///
    /// # Arguments
    /// * `env` - The contract environment
    /// * `trader` - Address of the position owner
    /// * `rwa_token` - Address of the RWA token for the position
    ///
    /// # Returns
    /// * `Ok(available)` - Amount of margin that can be safely removed
    /// * `Err(Error)` - Various errors (see error codes below)
    ///
    /// # Errors
    /// * `PositionNotFound` - Position doesn't exist
    /// * `MarketNotFound` - Market configuration not found
    /// * `OraclePriceNotFound` - Cannot fetch current price
    /// * `ArithmeticError` - Overflow in calculations
    /// * `DivisionByZero` - Position value is zero
    ///
    /// # Notes
    /// * Returns 0 if position is near the liquidation threshold
    /// * Includes a 0.5% safety buffer above maintenance margin
    /// * Cannot withdraw more than the originally deposited margin
    pub fn get_available_margin(
        env: &Env,
        trader: &Address,
        rwa_token: &Address,
    ) -> Result<i128, Error> {
        let position = Storage::get_position(env, trader, rwa_token)
            .ok_or(Error::PositionNotFound)?;

        let market = Storage::get_market_config(env, rwa_token)
            .ok_or(Error::MarketNotFound)?;

        let current_price = Storage::get_current_price(env, rwa_token)
            .ok_or(Error::OraclePriceNotFound)?;

        let unrealized_pnl = Liquidations::calculate_unrealized_pnl(&position, current_price)?;
        let position_value = Liquidations::calculate_position_value(&position, current_price)?;
        let effective_margin = position.margin
            .checked_add(unrealized_pnl)
            .ok_or(Error::ArithmeticError)?;

        // Calculate minimum required margin with safety buffer
        let safe_threshold = (market.maintenance_margin as i128) + MARGIN_SAFETY_BUFFER_BP;
        let min_required = position_value
            .checked_mul(safe_threshold)
            .ok_or(Error::ArithmeticError)?
            .checked_div(BASIS_POINTS)
            .ok_or(Error::DivisionByZero)?;

        // Calculate available margin (returns 0 if negative)
        let available = effective_margin
            .checked_sub(min_required)
            .unwrap_or(0)
            .max(0);

        // Cap at actual deposited margin (can't withdraw more than was deposited)
        let available = available.min(position.margin);

        Ok(available)
    }
}
