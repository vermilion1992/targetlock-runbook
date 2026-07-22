import CodePreview from '@/app/components/shared/CodePreview'
import ChartPiestacked from './code/StackedCode'

const ChartPieStacked = () => {
  return (
    <>
      <CodePreview
        component={<ChartPiestacked />}
        title='Stacked'
        filePath='src/app/components/charts/shadcn/pie/code/StackedCode.tsx'
      />
    </>
  )
}

export default ChartPieStacked
