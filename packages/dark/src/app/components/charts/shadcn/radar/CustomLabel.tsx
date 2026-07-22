import CodePreview from '@/app/components/shared/CodePreview'
import ChartRadarLabelcustom from './code/CustomLabelCode'

const ChartRadarLabelCustom = () => {
  return (
    <>
      <CodePreview
        component={<ChartRadarLabelcustom />}
        title='Custom Label'
        filePath='src/app/components/charts/shadcn/radar/code/CustomLabelCode.tsx'
      />
    </>
  )
}

export default ChartRadarLabelCustom
