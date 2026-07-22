import CodePreview from '@/app/components/shared/CodePreview'
import ChartRadialshape from './code/ShapeCode'

const ChartRadialShape = () => {
  return (
    <>
      <CodePreview
        component={<ChartRadialshape />}
        title='Shape'
        filePath='src/app/components/charts/shadcn/radial/code/ShapeCode.tsx'
      />
    </>
  )
}

export default ChartRadialShape
