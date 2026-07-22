import CodePreview from '@/app/components/shared/CodePreview'
import ChartBarstacked from './code/StackedLegendCode'

const ChartBarStacked = () => {
  return (
    <>
      <CodePreview
        component={<ChartBarstacked />}
        title='Stacked + Legend'
        filePath='src/app/components/charts/shadcn/bar/code/StackedLegendCode.tsx'
      />
    </>
  )
}

export default ChartBarStacked
