import CodePreview from '@/app/components/shared/CodePreview'
import ChartBarhorizontal from './code/HorizontalCode'

const ChartBarHorizontal = () => {
  return (
    <>
      <CodePreview
        component={<ChartBarhorizontal />}
        title='Horizontal'
        filePath='src/app/components/charts/shadcn/bar/code/HorizontalCode.tsx'
      />
    </>
  )
}

export default ChartBarHorizontal
