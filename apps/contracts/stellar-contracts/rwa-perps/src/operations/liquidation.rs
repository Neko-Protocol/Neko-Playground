use soroban_sdk::{Address, Env};

use crate::common::error::Error;
use crate::common::events::Events;
use crate::common::storage::Storage;
use crate::common::types::{Position, BASIS_POINTS, SCALAR_9};

/// Liquidation penalty in basis points (5% = 500 basis points)
const LIQUIDATION_PENALTY_BP: i128 = 500;

/// Liquidation functions for RWA Perpetuals
pub struct Liquidations;

impl Liquidations {
    /// Check if a position meets liquidation criteria
    ///
    /// Evaluates whether a position is undercollateralized by calculating the margin ratio
    /// and comparing it against the maintenance margin threshold.
    ///
    /// Margin Ratio = (margin + unrealized_pnl) / position_value
    ///
    /// A position is liquidatable if margin_ratio < maintenance_margin
    ///
    /// # Arguments
    /// * `env` - The contract environment
    /// * `trader` - Address of the position owner
    /// * `rwa_token` - Address of the RWA token for the position
    ///
    /// # Returns
    /// * `Ok(true)` - Position is liquidatable
    /// * `Ok(false)` - Position is healthy
    /// * `Err(Error)` - Position not found or other errors
    pub fn check_liquidation(
        env: &Env,
        trader: &Address,
        rwa_token: &Address,
    ) -> Result<bool, Error> {
        // Get the position
        let position = Storage::get_position(env, trader, rwa_token)
            .ok_or(Error::PositionNotFound)?;

        // Get market configuration for maintenance margin
        let market_config = Storage::get_market_config(env, rwa_token)
            .ok_or(Error::MarketNotFound)?;

        if !market_config.is_active {
            return Err(Error::MarketInactive);
        }

        // Get current price from oracle
        let current_price = Storage::get_current_price(env, rwa_token)
            .ok_or(Error::OraclePriceNotFound)?;

        // Calculate unrealized PnL
        // For long positions (size > 0): PnL = size * (current_price - entry_price)
        // For short positions (size < 0): PnL = size * (entry_price - current_price)
        let unrealized_pnl = Self::calculate_unrealized_pnl(&position, current_price)?;

        // Calculate position value at current price
        // position_value = abs(size) * current_price / SCALAR_9
        let position_value = Self::calculate_position_value(&position, current_price)?;

        // Calculate margin ratio: (margin + unrealized_pnl) / position_value
        // Both numerator and denominator should be in the same units
        let effective_margin = position.margin
            .checked_add(unrealized_pnl)
            .ok_or(Error::ArithmeticError)?;

        if position_value == 0 {
            return Err(Error::DivisionByZero);
        }

        // Margin ratio in basis points: (effective_margin * BASIS_POINTS) / position_value
        let margin_ratio = effective_margin
            .checked_mul(BASIS_POINTS)
            .ok_or(Error::ArithmeticError)?
            .checked_div(position_value)
            .ok_or(Error::DivisionByZero)?;

        // Check if margin ratio is below maintenance margin
        let is_liquidatable = margin_ratio < (market_config.maintenance_margin as i128);

        // Emit event
        Events::liquidation_check(env, trader, trader, is_liquidatable, margin_ratio);

        Ok(is_liquidatable)
    }

    /// Liquidate an undercollateralized position
    ///
    /// Closes a position that has fallen below the maintenance margin requirement.
    /// The liquidation process:
    /// 1. Closes the position at current market price
    /// 2. Applies a liquidation penalty (~5% of position value)
    /// 3. Rewards the liquidator with remaining margin after penalty
    ///
    /// # Arguments
    /// * `env` - The contract environment
    /// * `liquidator` - Address of the liquidator
    /// * `trader` - Address of the position owner to liquidate
    /// * `rwa_token` - Address of the RWA token for the position
    ///
    /// # Returns
    /// * `Ok(liquidator_reward)` - Amount rewarded to liquidator
    /// * `Err(Error)` - Position not liquidatable or other errors
    pub fn liquidate_position(
        env: &Env,
        liquidator: &Address,
        trader: &Address,
        rwa_token: &Address,
    ) -> Result<i128, Error> {
        // Require liquidator authorization
        liquidator.require_auth();

        // Check if position is liquidatable
        let is_liquidatable = Self::check_liquidation(env, trader, rwa_token)?;
        if !is_liquidatable {
            return Err(Error::PositionNotLiquidatable);
        }

        // Get the position
        let position = Storage::get_position(env, trader, rwa_token)
            .ok_or(Error::PositionNotFound)?;

        // Get current price
        let current_price = Storage::get_current_price(env, rwa_token)
            .ok_or(Error::OraclePriceNotFound)?;

        // Calculate unrealized PnL
        let unrealized_pnl = Self::calculate_unrealized_pnl(&position, current_price)?;

        // Calculate position value
        let position_value = Self::calculate_position_value(&position, current_price)?;

        // Calculate liquidation penalty (5% of position value)
        let liquidation_penalty = position_value
            .checked_mul(LIQUIDATION_PENALTY_BP)
            .ok_or(Error::ArithmeticError)?
            .checked_div(BASIS_POINTS)
            .ok_or(Error::DivisionByZero)?;

        // Calculate effective margin after PnL
        let effective_margin = position.margin
            .checked_add(unrealized_pnl)
            .ok_or(Error::ArithmeticError)?;

        // Calculate liquidator reward (remaining margin after penalty)
        // liquidator_reward = max(0, effective_margin - liquidation_penalty)
        let liquidator_reward = effective_margin
            .checked_sub(liquidation_penalty)
            .ok_or(Error::ArithmeticError)?
            .max(0);

        // Emit liquidation event
        Events::position_liquidated(
            env,
            trader,
            trader,
            liquidator,
            position.size,
            current_price,
            liquidation_penalty,
            liquidator_reward,
        );

        // Remove the position (close it)
        Storage::remove_position(env, trader, rwa_token);

        // In a real implementation, we would:
        // 1. Transfer liquidation penalty to protocol treasury
        // 2. Transfer liquidator reward to liquidator
        // 3. Close the position in the market
        // 4. Update funding payments

        Ok(liquidator_reward)
    }

    /// Calculate the price at which a position would be liquidated
    ///
    /// Uses the formula:
    /// liquidation_price = entry_price * (1 - (maintenance_margin / leverage))
    ///
    /// For long positions: price decreases trigger liquidation
    /// For short positions: price increases trigger liquidation
    ///
    /// # Arguments
    /// * `env` - The contract environment
    /// * `trader` - Address of the position owner
    /// * `rwa_token` - Address of the RWA token for the position
    ///
    /// # Returns
    /// * `Ok(liquidation_price)` - Price at which liquidation would occur
    /// * `Err(Error)` - Position not found or calculation errors
    pub fn get_liquidation_price(
        env: &Env,
        trader: &Address,
        rwa_token: &Address,
    ) -> Result<i128, Error> {
        // Get the position
        let position = Storage::get_position(env, trader, rwa_token)
            .ok_or(Error::PositionNotFound)?;

        // Get market configuration for maintenance margin
        let market_config = Storage::get_market_config(env, rwa_token)
            .ok_or(Error::MarketNotFound)?;

        if position.leverage == 0 {
            return Err(Error::DivisionByZero);
        }

        // Calculate maintenance_margin / leverage ratio
        // Both are in basis points (e.g., 500 for 5%, 1000 for 10x)
        // mm_leverage_ratio = maintenance_margin / leverage (in basis points)
        let mm_leverage_ratio = (market_config.maintenance_margin as i128)
            .checked_mul(BASIS_POINTS)
            .ok_or(Error::ArithmeticError)?
            .checked_div(position.leverage as i128)
            .ok_or(Error::DivisionByZero)?;

        // For long positions: liquidation_price = entry_price * (1 - mm_leverage_ratio)
        // For short positions: liquidation_price = entry_price * (1 + mm_leverage_ratio)
        let liquidation_price = if position.size > 0 {
            // Long position
            let factor = BASIS_POINTS
                .checked_sub(mm_leverage_ratio)
                .ok_or(Error::ArithmeticError)?;

            position.entry_price
                .checked_mul(factor)
                .ok_or(Error::ArithmeticError)?
                .checked_div(BASIS_POINTS)
                .ok_or(Error::DivisionByZero)?
        } else {
            // Short position
            let factor = BASIS_POINTS
                .checked_add(mm_leverage_ratio)
                .ok_or(Error::ArithmeticError)?;

            position.entry_price
                .checked_mul(factor)
                .ok_or(Error::ArithmeticError)?
                .checked_div(BASIS_POINTS)
                .ok_or(Error::DivisionByZero)?
        };

        // Emit event
        Events::liquidation_price_calculated(env, trader, trader, liquidation_price);

        Ok(liquidation_price)
    }

    // Helper functions

    /// Calculate unrealized PnL for a position
    pub fn calculate_unrealized_pnl(position: &Position, current_price: i128) -> Result<i128, Error> {
        let price_diff = current_price
            .checked_sub(position.entry_price)
            .ok_or(Error::ArithmeticError)?;

        // PnL = size * price_diff / SCALAR_9
        // For long (size > 0): positive when price increases
        // For short (size < 0): positive when price decreases
        let pnl = position.size
            .checked_mul(price_diff)
            .ok_or(Error::ArithmeticError)?
            .checked_div(SCALAR_9)
            .ok_or(Error::DivisionByZero)?;

        Ok(pnl)
    }

    /// Calculate position value at current price
    pub fn calculate_position_value(position: &Position, current_price: i128) -> Result<i128, Error> {
        let abs_size = if position.size < 0 {
            position.size
                .checked_neg()
                .ok_or(Error::ArithmeticError)?
        } else {
            position.size
        };

        let value = abs_size
            .checked_mul(current_price)
            .ok_or(Error::ArithmeticError)?
            .checked_div(SCALAR_9)
            .ok_or(Error::DivisionByZero)?;

        Ok(value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::common::types::Position;
    use soroban_sdk::{testutils::Address as _, Address, Env};

    // Note: These tests require a full contract implementation to run properly.
    // They are kept here for documentation purposes and should be moved to
    // integration tests once the RWAPerpsContract is implemented.
    //
    // The tests validate:
    // 1. check_liquidation() correctly identifies healthy and underwater positions
    // 2. liquidate_position() successfully liquidates underwater positions
    // 3. liquidate_position() rejects healthy positions
    // 4. get_liquidation_price() calculates correct liquidation trigger prices
    //
    // To run these tests, implement the RWAPerpsContract following the pattern
    // in rwa-lending/src/contract.rs and rwa-lending/src/test/mod.rs

    #[test]
    fn test_calculate_unrealized_pnl_long_profit() {
        // Test PnL calculation for a long position with profit
        let position = Position {
            trader: Address::generate(&Env::default()),
            rwa_token: Address::generate(&Env::default()),
            size: 100_000 * SCALAR_9, // Long 100,000 units (with SCALAR_9)
            entry_price: 100 * SCALAR_9, // Entry price with SCALAR_9
            margin: 10_000 * SCALAR_9,
            leverage: 1000,
            opened_at: 0,
            last_funding_payment: 0,
        };

        let current_price = 110 * SCALAR_9; // 10% price increase (with SCALAR_9)
        let pnl = Liquidations::calculate_unrealized_pnl(&position, current_price).unwrap();

        // Expected: (100_000 * SCALAR_9) * ((110 * SCALAR_9) - (100 * SCALAR_9)) / SCALAR_9
        //         = (100_000 * SCALAR_9) * (10 * SCALAR_9) / SCALAR_9
        //         = 100_000 * 10 * SCALAR_9
        //         = 1_000_000 * SCALAR_9
        let expected_pnl = 1_000_000 * SCALAR_9;
        assert_eq!(pnl, expected_pnl, "Long position profit should be 1,000,000 * SCALAR_9");
    }

    #[test]
    fn test_calculate_unrealized_pnl_long_loss() {
        // Test PnL calculation for a long position with loss
        let position = Position {
            trader: Address::generate(&Env::default()),
            rwa_token: Address::generate(&Env::default()),
            size: 100_000 * SCALAR_9,
            entry_price: 100 * SCALAR_9,
            margin: 10_000 * SCALAR_9,
            leverage: 1000,
            opened_at: 0,
            last_funding_payment: 0,
        };

        let current_price = 90 * SCALAR_9; // 10% price decrease
        let pnl = Liquidations::calculate_unrealized_pnl(&position, current_price).unwrap();

        // Expected: (100_000 * SCALAR_9) * ((90 * SCALAR_9) - (100 * SCALAR_9)) / SCALAR_9
        //         = (100_000 * SCALAR_9) * (-10 * SCALAR_9) / SCALAR_9
        //         = -1_000_000 * SCALAR_9
        let expected_pnl = -1_000_000 * SCALAR_9;
        assert_eq!(pnl, expected_pnl, "Long position loss should be -1,000,000 * SCALAR_9");
    }

    #[test]
    fn test_calculate_unrealized_pnl_short_profit() {
        // Test PnL calculation for a short position with profit
        let position = Position {
            trader: Address::generate(&Env::default()),
            rwa_token: Address::generate(&Env::default()),
            size: -100_000 * SCALAR_9, // Short 100,000 units
            entry_price: 100 * SCALAR_9,
            margin: 10_000 * SCALAR_9,
            leverage: 1000,
            opened_at: 0,
            last_funding_payment: 0,
        };

        let current_price = 90 * SCALAR_9; // 10% price decrease (profit for short)
        let pnl = Liquidations::calculate_unrealized_pnl(&position, current_price).unwrap();

        // Expected: (-100_000 * SCALAR_9) * ((90 * SCALAR_9) - (100 * SCALAR_9)) / SCALAR_9
        //         = (-100_000 * SCALAR_9) * (-10 * SCALAR_9) / SCALAR_9
        //         = 1_000_000 * SCALAR_9
        let expected_pnl = 1_000_000 * SCALAR_9;
        assert_eq!(pnl, expected_pnl, "Short position profit should be 1,000,000 * SCALAR_9");
    }

    #[test]
    fn test_calculate_position_value() {
        let position = Position {
            trader: Address::generate(&Env::default()),
            rwa_token: Address::generate(&Env::default()),
            size: 100_000 * SCALAR_9,
            entry_price: 100 * SCALAR_9,
            margin: 10_000 * SCALAR_9,
            leverage: 1000,
            opened_at: 0,
            last_funding_payment: 0,
        };

        let current_price = 110 * SCALAR_9;
        let value = Liquidations::calculate_position_value(&position, current_price).unwrap();

        // Expected: (100_000 * SCALAR_9) * (110 * SCALAR_9) / SCALAR_9
        //         = 100_000 * 110 * SCALAR_9
        //         = 11_000_000 * SCALAR_9
        let expected_value = 11_000_000 * SCALAR_9;
        assert_eq!(value, expected_value, "Position value should be 11,000,000 * SCALAR_9");
    }

    #[test]
    fn test_calculate_position_value_short() {
        // Test that position value is always positive (uses abs(size))
        let position = Position {
            trader: Address::generate(&Env::default()),
            rwa_token: Address::generate(&Env::default()),
            size: -100_000 * SCALAR_9, // Short position
            entry_price: 100 * SCALAR_9,
            margin: 10_000 * SCALAR_9,
            leverage: 1000,
            opened_at: 0,
            last_funding_payment: 0,
        };

        let current_price = 110 * SCALAR_9;
        let value = Liquidations::calculate_position_value(&position, current_price).unwrap();

        // Expected: abs(-100_000 * SCALAR_9) * (110 * SCALAR_9) / SCALAR_9
        //         = (100_000 * SCALAR_9) * (110 * SCALAR_9) / SCALAR_9
        //         = 11_000_000 * SCALAR_9
        let expected_value = 11_000_000 * SCALAR_9;
        assert_eq!(value, expected_value, "Short position value should be 11,000,000 * SCALAR_9");
    }
}
