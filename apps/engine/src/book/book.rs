use crate::{book::level::PriceLevel, types::Price};
use std::collections::BTreeMap;

pub struct OrderBook {
    bids: BTreeMap<Price, PriceLevel>,
    asks: BTreeMap<Price, PriceLevel>,
    next_order_id: u64,
}

impl OrderBook {
    pub fn new() -> Self {
        Self {
            bids: BTreeMap::new(),
            asks: BTreeMap::new(),
            next_order_id: 1,
        }
    }
}
