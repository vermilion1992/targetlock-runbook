import CodePreview from '@/app/components/shared/CodePreview'
import ChartPieinteractive from './code/InteractiveCode'

const ChartPieInteractive = () => {
  return (
    <>
      <CodePreview
        component={<ChartPieinteractive />}
        title='Interactive'
        filePath='src/app/components/charts/shadcn/pie/code/InteractiveCode.tsx'
      />
    </>
  )
}

export default ChartPieInteractive
