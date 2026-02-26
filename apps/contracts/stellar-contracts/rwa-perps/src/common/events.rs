#![allow(deprecated)]
use soroban_sdk::{Address, Env, symbol_short};

pub struct Events;

impl Events {
    /// Event emitted when a position is checked for liquidation
    pub fn liquidation_check(
        env: &Env,
        position_id: &Address,
        trader: &Address,
        is_liquidatable: bool,
        margin_ratio: i128,
    ) {
        let topics = (
            symbol_short!("liq_check"),
            position_id,
            trader,
        );
        env.events().publish(topics, (is_liquidatable, margin_ratio));
    }

    /// Event emitted when a position is liquidated
    pub fn position_liquidated(
        env: &Env,
        position_id: &Address,
        trader: &Address,
        liquidator: &Address,
        position_size: i128,
        liquidation_price: i128,
        liquidation_penalty: i128,
        liquidator_reward: i128,
    ) {
        let topics = (
            symbol_short!("liquidate"),
            position_id,
            trader,
            liquidator,
        );
        env.events().publish(
            topics,
            (position_size, liquidation_price, liquidation_penalty, liquidator_reward),
        );
    }

    /// Event emitted when liquidation price is calculated
    pub fn liquidation_price_calculated(
        env: &Env,
        position_id: &Address,
        trader: &Address,
        liquidation_price: i128,
    ) {
        let topics = (
            symbol_short!("liq_price"),
            position_id,
            trader,
        );
        env.events().publish(topics, liquidation_price);
    }

    /// Event emitted when contract is initialized
    pub fn contract_initialized(
        env: &Env,
        admin: &Address,
        oracle: &Address,
    ) {
        let topics = (symbol_short!("init"), admin);
        env.events().publish(topics, oracle);
    }

    /// Event emitted when oracle address is updated
    pub fn oracle_updated(
        env: &Env,
        old_oracle: &Address,
        new_oracle: &Address,
    ) {
        let topics = (symbol_short!("oracle"), old_oracle);
        env.events().publish(topics, new_oracle);
    }

    /// Event emitted when protocol pause state changes
    pub fn protocol_paused_updated(
        env: &Env,
        paused: bool,
    ) {
        let topics = (symbol_short!("paused"),);
        env.events().publish(topics, paused);
    }

    /// Event emitted when market config is updated
    pub fn market_config_updated(
        env: &Env,
        rwa_token: &Address,
        max_leverage: u32,
        maintenance_margin: u32,
    ) {
        let topics = (symbol_short!("mkt_cfg"), rwa_token);
        env.events().publish(topics, (max_leverage, maintenance_margin));
    }

    /// Event emitted when margin token is configured
    pub fn margin_token_set(
        env: &Env,
        token: &Address,
    ) {
        let topics = (symbol_short!("mrg_tkn"),);
        env.events().publish(topics, token);
    }

    /// Event emitted when margin is added to a position
    pub fn margin_added(
        env: &Env,
        trader: &Address,
        rwa_token: &Address,
        amount: i128,
        new_total_margin: i128,
    ) {
        let topics = (symbol_short!("mrg_add"), trader, rwa_token);
        env.events().publish(topics, (amount, new_total_margin));
    }

    /// Event emitted when margin is removed from a position
    pub fn margin_removed(
        env: &Env,
        trader: &Address,
        rwa_token: &Address,
        amount: i128,
        new_total_margin: i128,
        margin_ratio: i128,
    ) {
        let topics = (symbol_short!("mrg_rem"), trader, rwa_token);
        env.events().publish(topics, (amount, new_total_margin, margin_ratio));
    }

    /// Event emitted when a position is opened
    pub fn position_opened(
        env: &Env,
        trader: &Address,
        rwa_token: &Address,
        size: i128,
        entry_price: i128,
        margin: i128,
        leverage: u32,
    ) {
        let topics = (symbol_short!("pos_open"), trader, rwa_token);
        env.events().publish(topics, (size, entry_price, margin, leverage));
    }

    /// Event emitted when a position is closed (full or partial)
    ///
    /// # Event Data
    /// * `size_closed` - Amount of position size that was closed
    /// * `exit_price` - Price at which the position was closed
    /// * `pnl` - Realized profit/loss for the closed portion
    /// * `remaining_size` - Size remaining after close (0 if fully closed)
    ///
    /// # Note for Indexers
    /// This event is crucial for tracking position P&L and user balances.
    /// Future versions may include protocol fees deducted from the payout.
    pub fn position_closed(
        env: &Env,
        trader: &Address,
        rwa_token: &Address,
        size_closed: i128,
        exit_price: i128,
        pnl: i128,
        remaining_size: i128,
    ) {
        let topics = (symbol_short!("pos_close"), trader, rwa_token);
        env.events().publish(topics, (size_closed, exit_price, pnl, remaining_size));
    }

    /// Event emitted when a position is queried
    pub fn position_queried(
        env: &Env,
        trader: &Address,
        rwa_token: &Address,
        size: i128,
        margin: i128,
    ) {
        let topics = (symbol_short!("pos_get"), trader, rwa_token);
        env.events().publish(topics, (size, margin));
    }
}
