import CodePreview from '@/app/components/shared/CodePreview'
import ChartLineinteractive from './code/InteractiveCode'

const ChartLineInteractive = () => {
  return (
    <>
      <CodePreview
        component={<ChartLineinteractive />}
        title='Interactive'
        filePath='src/app/components/charts/shadcn/line/code/InteractiveCode.tsx'
      />
    </>
  )
}

export default ChartLineInteractive
