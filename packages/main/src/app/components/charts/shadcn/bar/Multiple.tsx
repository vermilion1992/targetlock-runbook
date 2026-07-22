import CodePreview from '@/app/components/shared/CodePreview'
import ChartBarmultiple from './code/MultipleCode'

const ChartBarMultiple = () => {
  return (
    <>
      <CodePreview
        component={<ChartBarmultiple />}
        title='Multiple'
        filePath='src/app/components/charts/shadcn/bar/code/MultipleCode.tsx'
      />
    </>
  )
}

export default ChartBarMultiple
