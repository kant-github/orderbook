import z from "zod";
import { SIDE } from "./trade";

export enum OrderType {
  NEW_ORDER = 'NEW_ORDER',
  CANCEL_ORDER = 'CANCEL_ORDER',
}

const decimal_string = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "must be a non-negative decimal string");

export const NewOrderSchema = z.object({
  client_order_id: z.string().min(1),
  market: z.string().min(1),
  side: z.enum(SIDE),
  order_type: z.literal('LIMIT'),
  price: decimal_string,
  quantity: decimal_string,
})

export const CancelOrderSchema = z.object({
  client_order_id: z.string().min(1),
  market: z.string().min(1),
})

type NewOrder = z.infer<typeof NewOrderSchema>;
type CancelOrder = z.infer<typeof CancelOrderSchema>;



export interface Envelope<T extends string, P> {
  seq: number;
  ts: number;
  type: T;
  payload: P;
}

export type NewOrderInEvent = Envelope<OrderType.NEW_ORDER, NewOrder>;
export type CancelOrderInEvent = Envelope<OrderType.CANCEL_ORDER, CancelOrder>;
