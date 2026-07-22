import CodePreview from '@/app/components/shared/CodePreview'
import ChartLinestep from './code/StepCode'

const ChartLineStep = () => {
  return (
    <>
      <CodePreview
        component={<ChartLinestep />}
        title='Step'
        filePath='src/app/components/charts/shadcn/line/code/StepCode.tsx'
      />
    </>
  )
}

export default ChartLineStep
