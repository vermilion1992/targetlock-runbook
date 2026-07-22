import CodePreview from '@/app/components/shared/CodePreview'
import ChartPieLabelcustom from './code/CustomLabelCode'

const ChartPieLabelCustom = () => {
  return (
    <>
      <CodePreview
        component={<ChartPieLabelcustom />}
        title='Custom Label'
        filePath='src/app/components/charts/shadcn/pie/code/CustomLabelCode.tsx'
      />
    </>
  )
}

export default ChartPieLabelCustom
