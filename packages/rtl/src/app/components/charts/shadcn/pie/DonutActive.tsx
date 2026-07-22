import CodePreview from '@/app/components/shared/CodePreview'
import ChartPieDonutactive from './code/DonutActiveCode'

const ChartPieDonutActive = () => {
  return (
    <>
      <CodePreview
        component={<ChartPieDonutactive />}
        title='Donut Active'
        filePath='src/app/components/charts/shadcn/pie/code/DonutActiveCode.tsx'
      />
    </>
  )
}

export default ChartPieDonutActive
