use super::{OrderId, Price, Quantity};

pub struct Trade {
    maker_id: OrderId,
    taker_id: OrderId,
    price: Price,
    quantity: Quantity,
}
