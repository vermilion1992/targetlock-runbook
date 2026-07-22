import CodePreview from '@/app/components/shared/CodePreview'
import ChartBarinteractive from './code/InteractiveCode'

const ChartBarInteractive = () => {
  return (
    <>
      <CodePreview
        component={<ChartBarinteractive />}
        title='Interactive'
        filePath='src/app/components/charts/shadcn/bar/code/InteractiveCode.tsx'
      />
    </>
  )
}

export default ChartBarInteractive
