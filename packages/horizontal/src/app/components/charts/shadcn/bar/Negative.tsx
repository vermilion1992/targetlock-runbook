import CodePreview from '@/app/components/shared/CodePreview'
import ChartBarnegative from './code/NegativeCode'

const ChartBarNegative = () => {
  return (
    <>
      <CodePreview
        component={<ChartBarnegative />}
        title='Negative'
        filePath='src/app/components/charts/shadcn/bar/code/NegativeCode.tsx'
      />
    </>
  )
}

export default ChartBarNegative
