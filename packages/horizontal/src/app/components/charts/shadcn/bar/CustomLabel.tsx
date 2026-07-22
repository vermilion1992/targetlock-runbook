import CodePreview from '@/app/components/shared/CodePreview'
import ChartBarLabelcustom from './code/CustomLabelCode'

const ChartBarLabelCustom = () => {
  return (
    <>
      <CodePreview
        component={<ChartBarLabelcustom />}
        title='Custom Label'
        filePath='src/app/components/charts/shadcn/bar/code/CustomLabelCode.tsx'
      />
    </>
  )
}

export default ChartBarLabelCustom
