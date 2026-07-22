import CodePreview from '@/app/components/shared/CodePreview'
import ChartAreastacked from './code/StackedCode'

const ChartAreaStacked = () => {
  return (
    <>
      <CodePreview
        component={<ChartAreastacked />}
        title='Stacked'
        filePath='src/app/components/charts/shadcn/area/code/StackedCode.tsx'
      />
    </>
  )
}

export default ChartAreaStacked
