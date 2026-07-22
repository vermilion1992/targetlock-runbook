import CodePreview from '@/app/components/shared/CodePreview'
import ChartPielegend from './code/LegendCode'

const ChartPieLegend = () => {
  return (
    <>
      <CodePreview
        component={<ChartPielegend />}
        title='Legend'
        filePath='src/app/components/charts/shadcn/pie/code/LegendCode.tsx'
      />
    </>
  )
}

export default ChartPieLegend
