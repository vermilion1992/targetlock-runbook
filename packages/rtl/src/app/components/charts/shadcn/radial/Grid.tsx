import CodePreview from '@/app/components/shared/CodePreview'
import ChartRadialgrid from './code/GridCode'

const ChartRadialGrid = () => {
  return (
    <>
      <CodePreview
        component={<ChartRadialgrid />}
        title='Grid'
        filePath='src/app/components/charts/shadcn/radial/code/GridCode.tsx'
      />
    </>
  )
}

export default ChartRadialGrid
