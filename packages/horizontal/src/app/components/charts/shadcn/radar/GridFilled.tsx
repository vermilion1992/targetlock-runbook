import CodePreview from '@/app/components/shared/CodePreview'
import ChartRadarGridfill from './code/GridFilledCode'

const ChartRadarGridFill = () => {
  return (
    <>
      <CodePreview
        component={<ChartRadarGridfill />}
        title='Grid Filled'
        filePath='src/app/components/charts/shadcn/radar/code/GridFilledCode.tsx'
      />
    </>
  )
}

export default ChartRadarGridFill
