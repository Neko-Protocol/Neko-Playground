use soroban_sdk::{Address, Env, String};

use crate::storage::{
    get_balance, get_compliance, get_holder_count, get_identity, get_issuer, get_purchase_time,
    is_frozen,
};
use crate::types::IdentityRecord;

fn kyc_level_rank(env: &Env, level: &String) -> u32 {
    let basic = String::from_str(env, "basic");
    let accredited = String::from_str(env, "accredited");
    let institutional = String::from_str(env, "institutional");
    if level == &basic {
        1
    } else if level == &accredited {
        2
    } else if level == &institutional {
        3
    } else {
        1
    }
}

pub fn can_transfer(env: &Env, from: &Address, to: &Address, _amount: i128) -> bool {
    if is_frozen(env, from) {
        return false;
    }

    let compliance = get_compliance(env);

    let issuer = get_issuer(env);
    if from != &issuer && compliance.lockup_days > 0 {
        let purchase_time = get_purchase_time(env, from);
        if purchase_time > 0 {
            let lockup_secs = (compliance.lockup_days as u64) * 86400;
            let now = env.ledger().timestamp();
            if now < purchase_time + lockup_secs {
                return false;
            }
        }
    }

    if is_frozen(env, to) {
        return false;
    }

    let identity: IdentityRecord = match get_identity(env, to) {
        Some(id) => id,
        None => return false,
    };

    if !identity.verified {
        return false;
    }

    let required_rank = kyc_level_rank(env, &compliance.kyc_level);
    let holder_rank = kyc_level_rank(env, &identity.kyc_level);
    if holder_rank < required_rank {
        return false;
    }

    if !compliance.allowed_countries.is_empty() {
        let country_allowed = compliance
            .allowed_countries
            .iter()
            .any(|c| c == identity.country);
        if !country_allowed {
            return false;
        }
    }

    let current_balance = get_balance(env, to);
    if current_balance == 0 && compliance.max_investors > 0 {
        let count = get_holder_count(env);
        if count >= compliance.max_investors {
            return false;
        }
    }

    true
}
