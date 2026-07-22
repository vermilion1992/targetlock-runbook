import CodePreview from '@/app/components/shared/CodePreview'
import ChartPieDonuttext from './code/DonutWithTextCode'

const ChartPieDonutText = () => {
  return (
    <>
      <CodePreview
        component={<ChartPieDonuttext />}
        title='Donut With Text'
        filePath='src/app/components/charts/shadcn/pie/code/DonutWithTextCode.tsx'
      />
    </>
  )
}

export default ChartPieDonutText
