use std::ops::{Add, AddAssign, Sub, SubAssign};
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Price(pub i64);

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Quantity(pub i64);

impl Quantity {
    pub const ZERO: Quantity = Quantity(0);

    pub fn is_zero(self) -> bool {
        self.0 == 0
    }

    pub fn is_positive(self) -> bool {
        self.0 > 0
    }
    pub fn min(self, other: Quantity) -> Quantity {
        let min_quantity = self.0.min(other.0);
        Quantity(min_quantity)
    }
}

impl Add for Quantity {
    type Output = Quantity;
    fn add(self, rhs: Quantity) -> Quantity {
        Quantity(self.0.add(rhs.0))
    }
}

impl Sub for Quantity {
    type Output = Quantity;
    fn sub(self, rhs: Quantity) -> Quantity {
        Quantity(self.0 - rhs.0)
    }
}

impl AddAssign for Quantity {
    fn add_assign(&mut self, rhs: Quantity) {
        self.0 += rhs.0
    }
}

impl SubAssign for Quantity {
    fn sub_assign(&mut self, rhs: Quantity) {
        self.0 -= rhs.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quantity_arithmetic() {
        let a = Quantity(5);
        let b = Quantity(3);
        assert_eq!(a + b, Quantity(8));
        assert_eq!(a - b, Quantity(2));
        assert_eq!(a.min(b), Quantity(3));
    }

    #[test]
    fn quantity_assign() {
        let mut q = Quantity(10);
        q -= Quantity(4);
        assert_eq!(q, Quantity(6));
        assert!(!q.is_zero());
        q -= Quantity(6);
        assert!(q.is_zero());
        assert!(!q.is_positive());
    }
}
