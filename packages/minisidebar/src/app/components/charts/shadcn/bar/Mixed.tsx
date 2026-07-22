import CodePreview from '@/app/components/shared/CodePreview'
import ChartBarmixed from './code/MixedCode'

const ChartBarMixed = () => {
  return (
    <>
      <CodePreview
        component={<ChartBarmixed />}
        title='Mixed'
        filePath='src/app/components/charts/shadcn/bar/code/MixedCode.tsx'
      />
    </>
  )
}

export default ChartBarMixed
