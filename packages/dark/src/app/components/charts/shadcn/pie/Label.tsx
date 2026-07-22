import CodePreview from '@/app/components/shared/CodePreview'
import ChartPielabel from './code/LabelCode'

const ChartPieLabel = () => {
  return (
    <>
      <CodePreview
        component={<ChartPielabel />}
        title='Label'
        filePath='src/app/components/charts/shadcn/pie/code/LabelCode.tsx'
      />
    </>
  )
}

export default ChartPieLabel
