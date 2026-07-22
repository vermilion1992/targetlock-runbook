import CodePreview from '@/app/components/shared/CodePreview'
import ChartBarlabel from './code/LabelCode'

const ChartBarLabel = () => {
  return (
    <>
      <CodePreview
        component={<ChartBarlabel />}
        title='Label'
        filePath='src/app/components/charts/shadcn/bar/code/LabelCode.tsx'
      />
    </>
  )
}

export default ChartBarLabel
