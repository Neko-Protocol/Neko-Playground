use soroban_sdk::{Address, Env, Vec};
use soroban_sdk::token::TokenClient;

use crate::common::error::Error;
use crate::common::events::Events;
use crate::common::storage::Storage;
use crate::common::types::{Position, BASIS_POINTS, SCALAR_9};
use crate::operations::liquidation::Liquidations;

/// Position management functions for RWA Perpetuals
pub struct Positions;

impl Positions {
    /// Open a new position (long or short)
    ///
    /// Creates a new perpetual futures position for the trader on the specified RWA token.
    /// The position can be long (positive size) or short (negative size) with specified leverage.
    ///
    /// # Price Execution and Slippage
    /// **IMPORTANT**: The entry price is determined by the oracle's `lastprice` at the moment
    /// of transaction execution. This means:
    /// - The actual entry price may differ from what the user sees when submitting the transaction
    /// - Users are exposed to potential front-running and price slippage
    /// - In a production environment, consider adding `expected_price` or `max_slippage` parameters
    ///
    /// # Arguments
    /// * `env` - The contract environment
    /// * `trader` - Address of the trader opening the position (must authorize transaction)
    /// * `rwa_token` - Address of the RWA token to trade
    /// * `size` - Position size (positive for long, negative for short)
    /// * `leverage` - Leverage multiplier in basis points (e.g., 1000 = 10x)
    /// * `margin` - Collateral amount to deposit
    ///
    /// # Returns
    /// * `Ok(())` - Position successfully opened
    /// * `Err(Error)` - Various errors (see error codes below)
    ///
    /// # Errors
    /// * `InvalidInput` - size is 0, leverage is 0, or margin is 0
    /// * `ProtocolPaused` - Protocol operations are paused
    /// * `MarketNotFound` - Market configuration not found
    /// * `MarketInactive` - Market is not active
    /// * `ExceedsMaxLeverage` - Leverage exceeds market maximum
    /// * `InsufficientInitialMargin` - Margin below initial requirement
    /// * `PositionAlreadyExists` - Trader already has a position for this token
    /// * `MarginTokenNotSet` - Margin token not configured
    /// * `OraclePriceNotFound` - Cannot fetch current price from oracle
    /// * `ArithmeticError` - Overflow in calculations
    /// * `DivisionByZero` - Division by zero in calculations
    pub fn open_position(
        env: &Env,
        trader: &Address,
        rwa_token: &Address,
        size: i128,
        leverage: u32,
        margin: i128,
    ) -> Result<(), Error> {
        // 1. Authorization
        trader.require_auth();

        // 2. Protocol state validation
        let storage = Storage::get(env);
        if storage.protocol_paused {
            return Err(Error::ProtocolPaused);
        }

        // 3. Input validation
        if size == 0 {
            return Err(Error::InvalidInput);
        }
        if leverage == 0 {
            return Err(Error::InvalidInput);
        }
        if margin <= 0 {
            return Err(Error::InvalidInput);
        }

        // 4. Get and validate market config
        let market = Storage::get_market_config(env, rwa_token)
            .ok_or(Error::MarketNotFound)?;
        
        if !market.is_active {
            return Err(Error::MarketInactive);
        }

        if leverage > market.max_leverage {
            return Err(Error::ExceedsMaxLeverage);
        }

        // 5. Get current price from oracle (integrated via Storage::get_current_price)
        let current_price = Storage::get_current_price(env, rwa_token)
            .ok_or(Error::OraclePriceNotFound)?;

        // 6. Calculate position value
        let abs_size = if size < 0 {
            size.checked_neg().ok_or(Error::ArithmeticError)?
        } else {
            size
        };
        
        let position_value = abs_size
            .checked_mul(current_price)
            .ok_or(Error::ArithmeticError)?
            .checked_div(SCALAR_9)
            .ok_or(Error::DivisionByZero)?;

        // 7. Validate margin requirements
        let required_initial_margin = position_value
            .checked_mul(market.initial_margin as i128)
            .ok_or(Error::ArithmeticError)?
            .checked_div(BASIS_POINTS)
            .ok_or(Error::DivisionByZero)?;

        if margin < required_initial_margin {
            return Err(Error::InsufficientInitialMargin);
        }

        // 8. Check for existing position
        if Storage::get_position(env, trader, rwa_token).is_some() {
            return Err(Error::PositionAlreadyExists);
        }

        // 9. Transfer margin from trader to contract
        let margin_token = Storage::get_margin_token(env)
            .ok_or(Error::MarginTokenNotSet)?;
        let token_client = TokenClient::new(env, &margin_token);
        let contract_address = env.current_contract_address();
        token_client.transfer(trader, &contract_address, &margin);

        // 10. Create Position struct and store
        let position = Position {
            trader: trader.clone(),
            rwa_token: rwa_token.clone(),
            size,
            entry_price: current_price,
            margin,
            leverage,
            opened_at: env.ledger().timestamp(),
            last_funding_payment: 0,
        };
        
        Storage::set_position(env, trader, rwa_token, &position);

        // 11. Add rwa_token to trader's token list
        Storage::add_trader_token(env, trader, rwa_token);

        // 12. Emit position_opened event
        Events::position_opened(env, trader, rwa_token, size, current_price, margin, leverage);

        Ok(())
    }

    /// Close a position (full or partial)
    ///
    /// Closes all or part of an existing position, calculating P&L based on current market price
    /// and transferring the appropriate payout (margin + P&L) back to the trader.
    ///
    /// # Arguments
    /// * `env` - The contract environment
    /// * `trader` - Address of the position owner (must authorize transaction)
    /// * `rwa_token` - Address of the RWA token for the position
    /// * `size_to_close` - Absolute size to close (must be > 0 and <= abs(position.size))
    ///
    /// # Returns
    /// * `Ok(())` - Position successfully closed (full or partial)
    /// * `Err(Error)` - Various errors (see error codes below)
    ///
    /// # Errors
    /// * `InvalidInput` - size_to_close is <= 0 or exceeds position size
    /// * `ProtocolPaused` - Protocol operations are paused
    /// * `PositionNotFound` - Position doesn't exist
    /// * `OraclePriceNotFound` - Cannot fetch current price from oracle
    /// * `MarginTokenNotSet` - Margin token not configured
    /// * `ArithmeticError` - Overflow in calculations
    /// * `DivisionByZero` - Division by zero in calculations
    pub fn close_position(
        env: &Env,
        trader: &Address,
        rwa_token: &Address,
        size_to_close: i128,
    ) -> Result<(), Error> {
        // 1. Authorization
        trader.require_auth();

        // 2. Protocol state validation
        let storage = Storage::get(env);
        if storage.protocol_paused {
            return Err(Error::ProtocolPaused);
        }

        // 3. Input validation
        if size_to_close <= 0 {
            return Err(Error::InvalidInput);
        }

        // 4. Get position
        let position = Storage::get_position(env, trader, rwa_token)
            .ok_or(Error::PositionNotFound)?;

        // 5. Validate size_to_close
        let abs_position_size = if position.size < 0 {
            position.size.checked_neg().ok_or(Error::ArithmeticError)?
        } else {
            position.size
        };

        if size_to_close > abs_position_size {
            return Err(Error::InvalidInput);
        }

        // 6. Get current price from oracle (integrated via Storage::get_current_price)
        let current_price = Storage::get_current_price(env, rwa_token)
            .ok_or(Error::OraclePriceNotFound)?;

        // 7. Calculate P&L and payout
        let total_pnl = Liquidations::calculate_unrealized_pnl(&position, current_price)?;
        
        // Determine if this is a full or partial close
        let is_full_close = size_to_close == abs_position_size;
        
        let (pnl_for_close, margin_to_return, payout) = if is_full_close {
            // Full close: return all remaining margin + total P&L
            // This avoids dust from rounding errors
            let payout_amount = position.margin
                .checked_add(total_pnl)
                .ok_or(Error::ArithmeticError)?
                .max(0); // Prevent negative payouts
            
            (total_pnl, position.margin, payout_amount)
        } else {
            // Partial close: prorate margin and P&L
            // IMPORTANT: Multiply first, then divide to preserve precision
            
            // Prorate P&L: pnl_for_close = (total_pnl * size_to_close) / abs(position.size)
            let pnl_partial = total_pnl
                .checked_mul(size_to_close)
                .ok_or(Error::ArithmeticError)?
                .checked_div(abs_position_size)
                .ok_or(Error::DivisionByZero)?;
            
            // Prorate margin: margin_to_return = (position.margin * size_to_close) / abs(position.size)
            let margin_partial = position.margin
                .checked_mul(size_to_close)
                .ok_or(Error::ArithmeticError)?
                .checked_div(abs_position_size)
                .ok_or(Error::DivisionByZero)?;
            
            // Calculate payout: margin + P&L (capped at 0 if negative)
            let payout_amount = margin_partial
                .checked_add(pnl_partial)
                .ok_or(Error::ArithmeticError)?
                .max(0); // Prevent negative payouts
            
            (pnl_partial, margin_partial, payout_amount)
        };

        // 8. Transfer payout to trader (only if > 0)
        if payout > 0 {
            let margin_token = Storage::get_margin_token(env)
                .ok_or(Error::MarginTokenNotSet)?;
            let token_client = TokenClient::new(env, &margin_token);
            let contract_address = env.current_contract_address();
            token_client.transfer(&contract_address, trader, &payout);
        }

        // 9. Update or remove position
        let remaining_size = if is_full_close {
            // Full close: remove position
            Storage::remove_position(env, trader, rwa_token);
            Storage::remove_trader_token(env, trader, rwa_token);
            0
        } else {
            // Partial close: update position
            let remaining_margin = position.margin
                .checked_sub(margin_to_return)
                .ok_or(Error::ArithmeticError)?;

            // Calculate remaining absolute size using checked operations
            let remaining_abs_size = abs_position_size
                .checked_sub(size_to_close)
                .ok_or(Error::ArithmeticError)?;

            // Apply sign based on original position direction (long/short)
            let new_size = if position.size < 0 {
                remaining_abs_size.checked_neg().ok_or(Error::ArithmeticError)?
            } else {
                remaining_abs_size
            };

            let updated_position = Position {
                size: new_size,
                margin: remaining_margin,
                ..position
            };

            Storage::set_position(env, trader, rwa_token, &updated_position);
            new_size
        };

        // 10. Emit position_closed event
        Events::position_closed(
            env,
            trader,
            rwa_token,
            size_to_close,
            current_price,
            pnl_for_close,
            remaining_size,
        );

        Ok(())
    }

    /// Get a specific position for a trader
    ///
    /// Retrieves the position details for a trader on a specific RWA token.
    ///
    /// # Arguments
    /// * `env` - The contract environment
    /// * `trader` - Address of the trader
    /// * `rwa_token` - Address of the RWA token
    ///
    /// # Returns
    /// * `Ok(Position)` - Position details
    /// * `Err(Error::PositionNotFound)` - Position doesn't exist
    pub fn get_position(
        env: &Env,
        trader: &Address,
        rwa_token: &Address,
    ) -> Result<Position, Error> {
        let position = Storage::get_position(env, trader, rwa_token)
            .ok_or(Error::PositionNotFound)?;

        // Emit position_queried event
        Events::position_queried(env, trader, rwa_token, position.size, position.margin);

        Ok(position)
    }

    /// Get all positions for a trader
    ///
    /// Retrieves all open positions for a trader across all RWA tokens.
    ///
    /// # Arguments
    /// * `env` - The contract environment
    /// * `trader` - Address of the trader
    ///
    /// # Returns
    /// * `Vec<Position>` - Vector of all positions (empty if trader has no positions)
    pub fn get_user_positions(
        env: &Env,
        trader: &Address,
    ) -> Vec<Position> {
        let mut positions = Vec::new(env);

        // Get all rwa_tokens for trader
        if let Some(tokens) = Storage::get_trader_tokens(env, trader) {
            // Iterate through all tokens and collect positions
            for rwa_token in tokens.keys() {
                if let Some(position) = Storage::get_position(env, trader, &rwa_token) {
                    positions.push_back(position);
                }
            }
        }

        positions
    }
}
