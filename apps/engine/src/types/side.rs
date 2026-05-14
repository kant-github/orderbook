#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Side {
    Ask,
    Bid,
}

impl Side {
    fn opposite(&self) -> Self {
        match self {
            Side::Ask => Side::Bid,
            Side::Bid => Side::Ask,
        }
    }
}
