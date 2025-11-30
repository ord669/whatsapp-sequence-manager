import { NextResponse } from 'next/server'

type RouteParams = {
  params: {
    id: string
  }
}

export async function POST(_: Request, { params }: RouteParams) {
  if (!params?.id) {
    return NextResponse.json(
      { error: 'Subscription id is required' },
      { status: 400 }
    )
  }

  return NextResponse.json(
    {
      message: 'Immediate send is not yet implemented for this subscription',
      subscriptionId: params.id,
    },
    { status: 501 }
  )
}

