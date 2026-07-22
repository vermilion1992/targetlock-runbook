import CodePreview from '@/app/components/shared/CodePreview'
import ChartAreastep from './code/StepCode'

const ChartAreaStep = () => {
  return (
    <>
      <CodePreview
        component={<ChartAreastep />}
        title='Step'
        filePath='src/app/components/charts/shadcn/area/code/StepCode.tsx'
      />
    </>
  )
}

export default ChartAreaStep
