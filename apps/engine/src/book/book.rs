use crate::{
    book::level::PriceLevel,
    types::{OrderId, Price, Quantity, Side, side, trade::Trade},
};
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
        bids.next_back().copied()
    }

    pub fn best_ask(&self) -> Option<Price> {
        let mut asks = self.asks.keys();
        asks.next().cloned()
    }

    pub fn place_limit_order(&mut self, side: Side, quantity: Quantity, price: Price) {
        let id = OrderId(self.next_order_id);
        self.next_order_id += 1;

        let mut remaining = quantity;
        let mut trades: Vec<Trade> = Vec::new();

        loop {
            if !remaining.is_positive() {
                break;
            }

            let opposite_best = match side {
                Side::Bid => self.asks.keys().next().copied(),
                Side::Ask => self.bids.keys().next_back().copied(),
            };

            let best_price = match opposite_best {
                Some(p) => p,
                None => break,
            };
            let crosses = match side {
                Side::Ask => best_price >= price,
                Side::Bid => best_price <= price,
            };

            if !crosses {
                break;
            }

            let opposite_book = match side {
                Side::Ask => &mut self.bids,
                Side::Bid => &mut self.asks,
            };
            let level = opposite_book.get_mut(&best_price).unwrap();
            while remaining.is_positive() {
                let maker_order = level.front_mut();
                let maker = match maker_order {
                    Some(p) => p,
                    None => break,
                };
                let fill_quantity = maker.remaining.min(remaining);
                trades.push(Trade {
                    maker_id: maker.id,
                    taker_id: id,
                    price: best_price,
                    quantity: fill_quantity,
                });
                maker.remaining -= fill_quantity;
                remaining -= fill_quantity;
                if !maker.remaining.is_zero() {
                    level.pop_front();
                }
            }
        }
    }
}
