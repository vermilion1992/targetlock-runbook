import CodePreview from '@/app/components/shared/CodePreview'
import ChartArealegend from './code/LegendCode'

const ChartAreaLegend = () => {
  return (
    <>
      <CodePreview
        component={<ChartArealegend />}
        title='Legend'
        filePath='src/app/components/charts/shadcn/area/code/LegendCode.tsx'
      />
    </>
  )
}

export default ChartAreaLegend
