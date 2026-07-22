import CodePreview from '@/app/components/shared/CodePreview'
import ChartLinemultiple from './code/MultipleCode'

const ChartLineMultiple = () => {
  return (
    <>
      <CodePreview
        component={<ChartLinemultiple />}
        title='Multiple'
        filePath='src/app/components/charts/shadcn/line/code/MultipleCode.tsx'
      />
    </>
  )
}

export default ChartLineMultiple
