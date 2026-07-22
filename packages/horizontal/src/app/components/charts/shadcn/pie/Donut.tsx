import CodePreview from '@/app/components/shared/CodePreview'
import ChartPiedonut from './code/DonutCode'

const ChartPieDonut = () => {
  return (
    <>
      <CodePreview
        component={<ChartPiedonut />}
        title='Donut'
        filePath='src/app/components/charts/shadcn/pie/code/DonutCode.tsx'
      />
    </>
  )
}

export default ChartPieDonut
