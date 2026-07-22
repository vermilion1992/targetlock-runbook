import CodePreview from '@/app/components/shared/CodePreview'
import ChartRadarGridcustom from './code/GridCustomCode'

const ChartRadarGridCustom = () => {
  return (
    <>
      <CodePreview
        component={<ChartRadarGridcustom />}
        title='Grid Custom'
        filePath='src/app/components/charts/shadcn/radar/code/GridCustomCode.tsx'
      />
    </>
  )
}

export default ChartRadarGridCustom
