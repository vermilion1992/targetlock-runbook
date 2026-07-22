import CodePreview from '@/app/components/shared/CodePreview'
import ChartLinelabel from './code/LabelCode'

const ChartLineLabel = () => {
  return (
    <>
      <CodePreview
        component={<ChartLinelabel />}
        title='Label'
        filePath='src/app/components/charts/shadcn/line/code/LabelCode.tsx'
      />
    </>
  )
}

export default ChartLineLabel
