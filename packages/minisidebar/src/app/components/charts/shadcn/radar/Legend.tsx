import CodePreview from '@/app/components/shared/CodePreview'
import ChartRadarlegend from './code/LegendCode'

const ChartRadarLegend = () => {
  return (
    <>
      <CodePreview
        component={<ChartRadarlegend />}
        title='Legend'
        filePath='src/app/components/charts/shadcn/radar/code/LegendCode.tsx'
      />
    </>
  )
}

export default ChartRadarLegend
