use crate::book::book::OrderBook;

mod book;
mod types;

fn main() {
    let book = OrderBook::new();
    println!("orderbook is : {:?}", book);
}
