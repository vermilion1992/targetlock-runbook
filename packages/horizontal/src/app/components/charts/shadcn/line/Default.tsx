import ChartLinedefault from './code/DefaultCode'
import CodePreview from '@/app/components/shared/CodePreview'

const ChartLineDefault = () => {
  return (
    <>
      <CodePreview
        component={<ChartLinedefault />}
        title='Default'
        filePath='src/app/components/charts/shadcn/line/code/DefaultCode.tsx'
      />
    </>
  )
}

export default ChartLineDefault
