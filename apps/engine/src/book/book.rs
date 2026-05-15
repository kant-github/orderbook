use crate::{book::level::PriceLevel, types::Price};
use std::collections::BTreeMap;
#[derive(Debug)]
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

    pub fn best_bid(&self) -> Option<Price> {
        let mut bids = self.bids.keys();
        let best_bid = bids.next_back().copied();
        best_bid
    }

    pub fn best_ask(&self) -> Option<Price> {
        let mut asks = self.asks.keys();
        asks.next().cloned()
    }
}
