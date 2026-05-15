use crate::types::Order;
use std::collections::VecDeque;

#[derive(Debug, Default)]
pub struct PriceLevel {
    orders: VecDeque<Order>,
}

impl PriceLevel {
    pub fn new() -> Self {
        Self {
            orders: VecDeque::new(),
        }
    }
    pub fn push_back(&mut self, order: Order) {
        self.orders.push_back(order);
    }
    pub fn pop_front(&mut self) -> Option<Order> {
        self.orders.pop_front()
    }
    pub fn front_mut(&mut self) -> Option<&mut Order> {
        self.orders.front_mut()
    }
    pub fn is_empty(&self) -> bool {
        self.orders.is_empty()
    }
}
