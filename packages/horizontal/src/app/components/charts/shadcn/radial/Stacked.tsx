import CodePreview from '@/app/components/shared/CodePreview'
import ChartRadialstacked from './code/StackedCode'

const ChartRadialStacked = () => {
  return (
    <>
      <CodePreview
        component={<ChartRadialstacked />}
        title='Stacked'
        filePath='src/app/components/charts/shadcn/radial/code/StackedCode.tsx'
      />
    </>
  )
}

export default ChartRadialStacked
