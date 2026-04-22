use soroban_sdk::{Address, Env, String};

use crate::compliance::can_transfer;
use crate::storage::{
    get_allowance, get_balance, get_holder_count, get_metadata, get_total_supply, set_allowance,
    set_balance, set_holder_count, set_purchase_time, set_total_supply,
};

pub fn balance(env: &Env, address: Address) -> i128 {
    get_balance(env, &address)
}

pub fn transfer(env: &Env, from: Address, to: Address, amount: i128) {
    from.require_auth();
    assert!(amount > 0, "amount must be positive");

    if !can_transfer(env, &from, &to, amount) {
        panic!("transfer not compliant");
    }

    let from_balance = get_balance(env, &from);
    assert!(from_balance >= amount, "insufficient balance");

    let to_balance = get_balance(env, &to);

    if to_balance == 0 {
        let count = get_holder_count(env);
        set_holder_count(env, count + 1);
        set_purchase_time(env, &to, env.ledger().timestamp());
    }

    set_balance(env, &from, from_balance - amount);
    set_balance(env, &to, to_balance + amount);
}

pub fn transfer_from(
    env: &Env,
    spender: Address,
    from: Address,
    to: Address,
    amount: i128,
) {
    spender.require_auth();
    let allowance = get_allowance(env, &from, &spender);
    assert!(allowance >= amount, "insufficient allowance");
    set_allowance(env, &from, &spender, allowance - amount);
    transfer(env, from, to, amount);
}

pub fn approve(
    env: &Env,
    from: Address,
    spender: Address,
    amount: i128,
    _expiration_ledger: u32,
) {
    from.require_auth();
    set_allowance(env, &from, &spender, amount);
}

pub fn allowance(env: &Env, from: Address, spender: Address) -> i128 {
    get_allowance(env, &from, &spender)
}

pub fn mint(env: &Env, to: Address, amount: i128) {
    let total = get_total_supply(env);
    let to_balance = get_balance(env, &to);
    set_balance(env, &to, to_balance + amount);
    set_total_supply(env, total + amount);
}

pub fn forced_transfer(env: &Env, from: Address, to: Address, amount: i128) {
    let from_balance = get_balance(env, &from);
    assert!(from_balance >= amount, "insufficient balance");
    let to_balance = get_balance(env, &to);
    set_balance(env, &from, from_balance - amount);
    set_balance(env, &to, to_balance + amount);
}

pub fn burn(env: &Env, from: Address, amount: i128) {
    from.require_auth();
    let from_balance = get_balance(env, &from);
    assert!(from_balance >= amount, "insufficient balance");
    set_balance(env, &from, from_balance - amount);
    let total = get_total_supply(env);
    set_total_supply(env, total - amount);
}

pub fn decimals(env: &Env) -> u32 {
    get_metadata(env).decimals
}

pub fn name(env: &Env) -> String {
    get_metadata(env).name
}

pub fn symbol(env: &Env) -> String {
    get_metadata(env).symbol
}

pub fn total_supply(env: &Env) -> i128 {
    get_total_supply(env)
}
