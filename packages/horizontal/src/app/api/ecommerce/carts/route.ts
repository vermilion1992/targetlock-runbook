import { NextResponse } from 'next/server'
import { ProductsData } from '../../../components/apps/ecommerce/product-data'
import type { ProductType } from '@/app/(DashboardLayout)/types/apps/ecommerce'

type CartItemType = ProductType & { qty: number }

let cartItems: CartItemType[] = []

export async function GET() {
  try {
    return NextResponse.json({ status: 200, msg: 'success', data: cartItems })
  } catch (error: unknown) {
    return NextResponse.json({ status: 400, msg: 'failed', error })
  }
}

export async function POST(req: Request) {
  try {
    const { productId, qty } = (await req.json()) as {
      productId: number | string
      qty?: number
    }
    const productToAdd = ProductsData.find(
      (product) => product.id === productId
    )
    if (!productToAdd) {
      return NextResponse.json({ status: 400, msg: 'Product not found' })
    }
    const isItemInCart = cartItems.find(
      (cartItem) => cartItem.id === productToAdd?.id
    )
    if (isItemInCart) {
      // if product available in the cart then update product to cartItems state
      const newItems = cartItems.map((cartItem) =>
        cartItem.id === productToAdd?.id
          ? { ...cartItem, qty: cartItem.qty + (qty || 1) }
          : cartItem
      )
      cartItems = newItems
    } else {
      // Add the product to cartItems state
      cartItems.push({ ...productToAdd, qty: qty || 1 })
    }

    return NextResponse.json({ status: 200, msg: 'Success', data: cartItems })
  } catch (error: unknown) {
    return NextResponse.json({
      status: 400,
      msg: 'Internal server error',
      data: error,
    })
  }
}

export async function PUT(req: Request) {
  try {
    const { id, action } = (await req.json()) as {
      id: number | string
      action: string
    }
    const productToAdd = ProductsData.find((product) => product.id === id)
    if (!productToAdd) {
      return NextResponse.json({ status: 400, msg: 'Product not found' })
    }
    if (action === 'Increment') {
      const newItems = cartItems.map((cartItem) =>
        cartItem.id === productToAdd?.id
          ? { ...cartItem, qty: cartItem.qty + 1 }
          : cartItem
      )
      cartItems = newItems
    } else {
      const newItems = cartItems.map((cartItem) =>
        cartItem.id === productToAdd?.id
          ? {
            ...cartItem,
            qty: cartItem.qty > 0 ? cartItem.qty - 1 : cartItem.qty,
          }
          : cartItem
      )
      cartItems = newItems
    }

    return NextResponse.json({ status: 200, msg: 'Success', data: cartItems })
  } catch (error: unknown) {
    return NextResponse.json({
      status: 400,
      msg: 'Internal server error',
      data: error,
    })
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = (await req.json()) as { id: number | string }
    const remainingItems = cartItems.filter((product) => {
      return product.id !== id
    })
    cartItems = remainingItems
    return NextResponse.json({ status: 200, msg: 'Success', data: cartItems })
  } catch (error: unknown) {
    return NextResponse.json({
      status: 400,
      msg: 'Internal server error',
      error,
    })
  }
}
