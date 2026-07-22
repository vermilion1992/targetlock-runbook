import CodePreview from '@/app/components/shared/CodePreview'
import ChartLineLabelcustom from './code/CustomLabelCode'

const ChartLineLabelCustom = () => {
  return (
    <>
      <CodePreview
        component={<ChartLineLabelcustom />}
        title='Custom Label'
        filePath='src/app/components/charts/shadcn/line/code/CustomLabelCode.tsx'
      />
    </>
  )
}

export default ChartLineLabelCustom
