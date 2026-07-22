import CodePreview from '@/app/components/shared/CodePreview'
import ChartBardefault from './code/DefaultCode'

const ChartBarDefault = () => {
  return (
    <>
      <CodePreview
        component={<ChartBardefault />}
        title='Default'
        filePath='src/app/components/charts/shadcn/bar/code/DefaultCode.tsx'
      />
    </>
  )
}

export default ChartBarDefault
