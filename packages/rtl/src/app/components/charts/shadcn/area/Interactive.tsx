import CodePreview from '@/app/components/shared/CodePreview'
import ChartAreainteractive from './code/InteractiveCode'

const ChartAreaInteractive = () => {
  return (
    <>
      <CodePreview
        component={<ChartAreainteractive />}
        title='Interactive'
        filePath='src/app/components/charts/shadcn/area/code/InteractiveCode.tsx'
      />
    </>
  )
}

export default ChartAreaInteractive
