'use client'

import CardBox from '../../shared/CardBox'
import Cardskeleton from './code/CardSkeletonCode'

const CardSkeleton = () => {
  return (
    <CardBox>
      <h4 className='text-lg font-semibold'>Card Skeleton</h4>
      <Cardskeleton />
    </CardBox>
  )
}

export default CardSkeleton
