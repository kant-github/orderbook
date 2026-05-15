use super::{OrderId, Price, Quantity};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Trade {
    pub maker_id: OrderId,
    pub taker_id: OrderId,
    pub price: Price,
    pub quantity: Quantity,
}
